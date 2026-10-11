import React, { useMemo, useState } from "react";
import SignaturePad from "@/components/ApplicationForms/SignaturePad";

export const MAX_SAMPLES = 50;

export const SAMPLE_FIELD_SUFFIXES = [
  "LaboratoriesTests",
  "Quantity",
  "ProductTypeModelClass",
  "SelectedFrom",
  "ProductionDateCodeSerial",
];

export const sampleFieldKey = (index, suffix) => `sample${index}${suffix}`;

export const SELECTED_SAMPLES_EDITABLE_KEYS = Array.from(
  { length: MAX_SAMPLES },
  (_, i) => i + 1,
).flatMap((index) =>
  SAMPLE_FIELD_SUFFIXES.map((suffix) => sampleFieldKey(index, suffix)),
);

const display = (value) => String(value ?? "").trim();

export const isSampleFilled = (values = {}, index) =>
  SAMPLE_FIELD_SUFFIXES.some(
    (suffix) => display(values[sampleFieldKey(index, suffix)]) !== "",
  );

export const deriveSampleCount = (values = {}) => {
  let highest = 0;
  for (let i = 1; i <= MAX_SAMPLES; i += 1) {
    if (isSampleFilled(values, i)) highest = i;
  }
  return highest;
};

export const collectFilledSamples = (values = {}) => {
  const rows = [];
  const count = deriveSampleCount(values);
  for (let i = 1; i <= count; i += 1) {
    if (!isSampleFilled(values, i)) continue;
    rows.push({
      index: i,
      laboratoriesTests: display(
        values[sampleFieldKey(i, "LaboratoriesTests")],
      ),
      quantity: display(values[sampleFieldKey(i, "Quantity")]),
      productTypeModelClass: display(
        values[sampleFieldKey(i, "ProductTypeModelClass")],
      ),
      selectedFrom: display(values[sampleFieldKey(i, "SelectedFrom")]),
      productionDateCodeSerial: display(
        values[sampleFieldKey(i, "ProductionDateCodeSerial")],
      ),
    });
  }
  return rows;
};

/**
 * Identification of Selected Samples — matches
 * `templates/selectedSamples.html` (AQCTA-FOR-01-15, A4 landscape).
 * Sample rows are dynamic (add / remove); PDF follows the same count.
 */
export default function CertificationSelectedSamplesForm({
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
  const canEditSamples = !readOnly;
  const setField = (key, value) => onChange?.(key, value);

  const derivedCount = Math.max(deriveSampleCount(values), 1);
  const [localSamples, setLocalSamples] = useState(0);
  const sampleCount = Math.min(
    MAX_SAMPLES,
    Math.max(localSamples, derivedCount),
  );

  const addSample = () => {
    if (sampleCount >= MAX_SAMPLES) return;
    const next = sampleCount + 1;
    SAMPLE_FIELD_SUFFIXES.forEach((suffix) =>
      setField(sampleFieldKey(next, suffix), ""),
    );
    setLocalSamples(next);
  };

  const removeSample = (index) => {
    if (sampleCount <= 1) {
      SAMPLE_FIELD_SUFFIXES.forEach((suffix) =>
        setField(sampleFieldKey(1, suffix), ""),
      );
      setLocalSamples(1);
      return;
    }
    for (let i = index; i < sampleCount; i += 1) {
      SAMPLE_FIELD_SUFFIXES.forEach((suffix) => {
        setField(
          sampleFieldKey(i, suffix),
          values[sampleFieldKey(i + 1, suffix)] ?? "",
        );
      });
    }
    SAMPLE_FIELD_SUFFIXES.forEach((suffix) =>
      setField(sampleFieldKey(sampleCount, suffix), ""),
    );
    setLocalSamples(Math.max(sampleCount - 1, 1));
  };

  const allowSign = Boolean(onPreparedSignatureChange) && !readOnly;
  const auditorSig = preparedSignature || preparedSignatureUrl;

  return (
    <div className="ss-page">
      <div className="ss-form-code">AQCTA-FOR-01-15</div>
      <div className="ss-title">IDENTIFICATION OF SELECTED SAMPLES</div>

      <div className="ss-table-wrap">
        <table className="ss-table">
          <thead>
            <tr>
              <th className="ss-col-sample">Samples</th>
              <th className="ss-col-lab">
                Laboratories and types of test conducted
                <br />
                chemical test, visual inspection
              </th>
              <th className="ss-col-qty">Quantity</th>
              <th className="ss-col-product">Product / Type / Model / Class</th>
              <th className="ss-col-selected">
                Selected from
                <br />
                production line / storage
              </th>
              <th className="ss-col-prod">
                Production date /
                <br />
                production code / Serial Number
              </th>
              {canEditSamples ? <th className="ss-col-actn" /> : null}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: sampleCount }, (_, i) => i + 1).map(
              (index) => {
                const labKey = sampleFieldKey(index, "LaboratoriesTests");
                const qtyKey = sampleFieldKey(index, "Quantity");
                const productKey = sampleFieldKey(
                  index,
                  "ProductTypeModelClass",
                );
                const selectedKey = sampleFieldKey(index, "SelectedFrom");
                const productionKey = sampleFieldKey(
                  index,
                  "ProductionDateCodeSerial",
                );
                return (
                  <tr key={index}>
                    <td className="ss-sample-name">Sample {index}</td>
                    <td>
                      {canEdit(labKey) ? (
                        <textarea
                          className={`ss-in ss-in--area${
                            invalid.has(labKey) ? " is-invalid" : ""
                          }`}
                          rows={2}
                          value={values[labKey] || ""}
                          onChange={(e) => setField(labKey, e.target.value)}
                        />
                      ) : (
                        <div className="ss-pre">{display(values[labKey])}</div>
                      )}
                    </td>
                    <td>
                      {canEdit(qtyKey) ? (
                        <input
                          type="text"
                          className={`ss-in${
                            invalid.has(qtyKey) ? " is-invalid" : ""
                          }`}
                          value={values[qtyKey] || ""}
                          onChange={(e) => setField(qtyKey, e.target.value)}
                        />
                      ) : (
                        display(values[qtyKey])
                      )}
                    </td>
                    <td>
                      {canEdit(productKey) ? (
                        <textarea
                          className={`ss-in ss-in--area${
                            invalid.has(productKey) ? " is-invalid" : ""
                          }`}
                          rows={2}
                          value={values[productKey] || ""}
                          onChange={(e) => setField(productKey, e.target.value)}
                        />
                      ) : (
                        <div className="ss-pre">
                          {display(values[productKey])}
                        </div>
                      )}
                    </td>
                    <td>
                      {canEdit(selectedKey) ? (
                        <textarea
                          className={`ss-in ss-in--area${
                            invalid.has(selectedKey) ? " is-invalid" : ""
                          }`}
                          rows={2}
                          value={values[selectedKey] || ""}
                          onChange={(e) =>
                            setField(selectedKey, e.target.value)
                          }
                        />
                      ) : (
                        <div className="ss-pre">
                          {display(values[selectedKey])}
                        </div>
                      )}
                    </td>
                    <td>
                      {canEdit(productionKey) ? (
                        <textarea
                          className={`ss-in ss-in--area${
                            invalid.has(productionKey) ? " is-invalid" : ""
                          }`}
                          rows={2}
                          value={values[productionKey] || ""}
                          onChange={(e) =>
                            setField(productionKey, e.target.value)
                          }
                        />
                      ) : (
                        <div className="ss-pre">
                          {display(values[productionKey])}
                        </div>
                      )}
                    </td>
                    {canEditSamples ? (
                      <td className="ss-col-actn">
                        <button
                          type="button"
                          className="ss-remove"
                          onClick={() => removeSample(index)}
                          aria-label={`Remove sample ${index}`}
                        >
                          Remove
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>

      {canEditSamples && sampleCount < MAX_SAMPLES ? (
        <button type="button" className="ss-add" onClick={addSample}>
          Add sample
        </button>
      ) : null}

      {(allowSign || auditorSig) && (
        <div className="ss-sign">
          <div className="ss-sign-label">Auditor</div>
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
              className="ss-sign-img"
              src={auditorSig}
              alt="Auditor signature"
            />
          ) : null}
        </div>
      )}

      <footer className="ss-footer">
        <div className="ss-footer-left">
          <div>AQC TECHNICAL ASSESSORS (M) SDN. BHD.</div>
          <div>Issue: 1&nbsp;&nbsp; Rev: 1</div>
        </div>
        <div className="ss-footer-center">Conformity Assessment</div>
        <div className="ss-footer-right">Page 1 of 1</div>
      </footer>
    </div>
  );
}
