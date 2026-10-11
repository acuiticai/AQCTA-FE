import React, { useMemo, useState } from "react";

export const MAX_CHANGES = 40;

export const CHANGE_FIELDS = [
  "edition",
  "pageNoDate",
  "details",
  "annex",
  "licenseNo",
  "approvedDate",
  "auditor",
  "verificationAuditor",
];

export const CERTIFICATION_REPORT_CHANGES_EDITABLE_KEYS = [];

const display = (value) => String(value ?? "").trim();

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

const deriveChangeCount = (values) => {
  let highest = 0;
  for (let i = 1; i <= MAX_CHANGES; i += 1) {
    const hit = CHANGE_FIELDS.some(
      (f) => display(values[`change_${i}_${f}`]) !== "",
    );
    if (hit) highest = i;
  }
  return highest;
};

/**
 * List of Changes to Certification Report / Licence — AQCTA-FOR-01-19.1.
 */
export default function CertificationReportChangesForm({
  values = {},
  onChange,
  readOnly = false,
  invalidKeys = [],
  repeatableRows = {},
  onAddRow,
  onRemoveRow,
}) {
  const invalid = useMemo(() => new Set(invalidKeys), [invalidKeys]);
  const setField = (key, value) => onChange?.(key, value);
  const canEditRows = !readOnly;

  const derivedCount = Math.max(deriveChangeCount(values), 1);
  const [localRows, setLocalRows] = useState(0);
  const rowCount = Math.min(
    MAX_CHANGES,
    Math.max(
      localRows,
      typeof repeatableRows?.changes === "number"
        ? repeatableRows.changes
        : derivedCount,
      derivedCount,
    ),
  );

  const addRow = () => {
    if (rowCount >= MAX_CHANGES) return;
    const next = rowCount + 1;
    CHANGE_FIELDS.forEach((f) => setField(`change_${next}_${f}`, ""));
    if (onAddRow) onAddRow("changes");
    else setLocalRows(next);
  };

  const removeRow = (index) => {
    if (rowCount <= 1) {
      CHANGE_FIELDS.forEach((f) => setField(`change_1_${f}`, ""));
      return;
    }
    for (let i = index; i < rowCount; i += 1) {
      CHANGE_FIELDS.forEach((f) => {
        setField(
          `change_${i}_${f}`,
          values[`change_${i + 1}_${f}`] ?? "",
        );
      });
    }
    CHANGE_FIELDS.forEach((f) => setField(`change_${rowCount}_${f}`, ""));
    if (onRemoveRow) onRemoveRow("changes", rowCount);
    else setLocalRows(Math.max(rowCount - 1, 1));
  };

  const cell = (i, field, opts = {}) => {
    const key = `change_${i}_${field}`;
    const bad = invalid.has(key);
    const value = values[key] || "";
    if (!canEditRows) {
      return (
        <td className={opts.className || ""}>
          {display(value) || "—"}
        </td>
      );
    }
    if (opts.type === "date") {
      return (
        <td className={opts.className || ""}>
          <input
            type="date"
            className={`crc-in${bad ? " is-invalid" : ""}`}
            value={toDateInputValue(value)}
            onChange={(e) =>
              setField(key, fromDateInputValue(e.target.value))
            }
          />
        </td>
      );
    }
    if (opts.multiline) {
      return (
        <td className={opts.className || ""}>
          <textarea
            className={`crc-in crc-in--area${bad ? " is-invalid" : ""}`}
            rows={2}
            value={value}
            onChange={(e) => setField(key, e.target.value)}
          />
        </td>
      );
    }
    return (
      <td className={opts.className || ""}>
        <input
          type="text"
          className={`crc-in${bad ? " is-invalid" : ""}`}
          value={value}
          onChange={(e) => setField(key, e.target.value)}
        />
      </td>
    );
  };

  return (
    <div className="crc-page">
      <header className="crc-header">
        <div className="crc-form-code">AQCTA-FOR-01-19-01</div>
        <h1 className="crc-title">
          LIST OF CHANGES TO CERTIFICATION REPORT/LICENCE
        </h1>
        <div className="crc-file">
          FILE NO: <span>{display(values.fileNo) || "—"}</span>
        </div>
      </header>

      <div className="crc-table-wrap">
        <table className="crc-table">
          <thead>
            <tr>
              <th className="crc-col-edition">Edition</th>
              <th className="crc-col-page">Page no. / date</th>
              <th className="crc-col-details">Details of changes</th>
              <th className="crc-col-annex">Annex attached / replaced</th>
              <th className="crc-col-license">License / Certificate Serial No.</th>
              <th className="crc-col-approved">Approved date</th>
              <th className="crc-col-auditor">Auditor</th>
              <th className="crc-col-verification">Verification Auditor</th>
              {canEditRows ? <th className="crc-col-actions" /> : null}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }, (_, idx) => {
              const i = idx + 1;
              return (
                <tr key={i}>
                  {cell(i, "edition")}
                  {cell(i, "pageNoDate")}
                  {cell(i, "details", {
                    className: "crc-details",
                    multiline: true,
                  })}
                  {cell(i, "annex")}
                  {cell(i, "licenseNo")}
                  {cell(i, "approvedDate", { type: "date" })}
                  {cell(i, "auditor")}
                  {cell(i, "verificationAuditor")}
                  {canEditRows ? (
                    <td className="crc-actions">
                      <button
                        type="button"
                        className="crc-remove"
                        onClick={() => removeRow(i)}
                      >
                        Remove
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canEditRows && rowCount < MAX_CHANGES ? (
        <button type="button" className="crc-add" onClick={addRow}>
          Add change
        </button>
      ) : null}

      <div className="crc-signoff">
        <div>
          Prepared by: {display(values.preparedByName) || "—"}
        </div>
        <div>
          Approved by: {display(values.approvedByName) || "—"}
        </div>
      </div>
    </div>
  );
}
