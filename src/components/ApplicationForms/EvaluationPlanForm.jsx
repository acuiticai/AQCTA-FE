import React, { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import Combobox from "@/customer/components/ui/Combobox";

const AQCTA_LOGO_SRC = `${process.env.PUBLIC_URL || ""}/aqcta-logo.png`;

const DEFAULT_ACTIVITIES = [
  "Standard Suitability Study",
  "Pre-Assessment / Gap Analysis",
  "Documentation Review",
  "Factory Audit",
  "Product Sampling",
  "Product Testing",
  "Certification Recommendation",
  "Certification Review and Certification Decision",
  "Issuance of Certificate",
];

const MAX_ACTIVITY_ROWS = 24;

const CellInput = ({
  value,
  onChange,
  readOnly,
  type = "text",
  placeholder = "",
  className = "",
}) => {
  if (readOnly) {
    const text = String(value ?? "").trim();
    return (
      <span className={`evp-dv ${className}`.trim()}>{text || ""}</span>
    );
  }
  return (
    <input
      type={type}
      className={`evp-in ${className}`.trim()}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
};

/**
 * Certification Evaluation Plan fill UI — matches
 * `templates/evaluationPlan.html` (AQCTA-FOR-01-25).
 *
 * Activity rows are added via dropdown from the standard catalogue (or a
 * custom name). Dynamic Forms ticks are not required.
 */
export default function EvaluationPlanForm({
  values = {},
  onChange,
  readOnly = false,
  invalidKeys = [],
  editableKeys = [],
  activityCatalog = [],
}) {
  const invalid = new Set(invalidKeys);
  const editable = new Set(editableKeys);
  const canEdit = (key) => !readOnly && editable.has(key);
  const lines = Array.isArray(values.activityLines) ? values.activityLines : [];

  const catalogOptions = useMemo(() => {
    const raw =
      Array.isArray(activityCatalog) && activityCatalog.length
        ? activityCatalog
        : DEFAULT_ACTIVITIES;
    const mapped = raw
      .map((opt) =>
        typeof opt === "string"
          ? { value: opt, label: opt }
          : {
              value: String(opt?.value || opt?.label || opt?.name || "").trim(),
              label: String(opt?.label || opt?.value || opt?.name || "").trim(),
            },
      )
      .filter((opt) => opt.value);
    return mapped.length
      ? mapped
      : DEFAULT_ACTIVITIES.map((v) => ({ value: v, label: v }));
  }, [activityCatalog]);

  const setField = (key, value) => onChange?.(key, value);
  const setLines = (next) => onChange?.("activityLines", next);

  const updateLine = (index, patch) => {
    if (readOnly) return;
    setLines(
      lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };

  const addLine = () => {
    if (readOnly || lines.length >= MAX_ACTIVITY_ROWS) return;
    if (lines.some((line) => !String(line.name || "").trim())) return;
    setLines([
      ...lines,
      { name: "", date: "", resource: "", standard: "", remarks: "" },
    ]);
  };

  const removeLine = (index) => {
    if (readOnly) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const canAdd =
    !readOnly &&
    lines.length < MAX_ACTIVITY_ROWS &&
    !lines.some((line) => !String(line.name || "").trim());

  return (
    <div className="evp-page">
      <div className="evp-header">
        <img className="evp-logo" src={AQCTA_LOGO_SRC} alt="AQCTA logo" />
        <div className="evp-doc-code">AQCTA-FOR-01-25</div>
      </div>
      <h1 className="evp-title">
        Conformity Assessment – Evaluation Plan
      </h1>

      <table className="evp-info-table">
        <tbody>
          <tr>
            <td className="evp-label">File / Job No</td>
            <td>
              <CellInput value={values.fileNo} readOnly />
            </td>
          </tr>
          <tr>
            <td className="evp-label">Company Name</td>
            <td>
              <CellInput value={values.companyName} readOnly />
            </td>
          </tr>
          <tr>
            <td className="evp-label">Company Address</td>
            <td>
              <CellInput value={values.companyAddress} readOnly />
            </td>
          </tr>
          <tr>
            <td className="evp-label">Product Standard</td>
            <td className={invalid.has("productStandard") ? "evp-bad" : ""}>
              <CellInput
                value={values.productStandard}
                readOnly={!canEdit("productStandard")}
                placeholder="e.g. MS 1234:2020"
                onChange={(v) => setField("productStandard", v)}
              />
            </td>
          </tr>
          <tr>
            <td className="evp-label">Product Name</td>
            <td>
              <CellInput value={values.productName} readOnly />
            </td>
          </tr>
        </tbody>
      </table>

      <table className="evp-act-table">
        <thead>
          <tr>
            <th className="evp-col-no">No.</th>
            <th className="evp-col-act">Evaluation activities</th>
            <th className="evp-col-date">
              Planned Date
              <br />
              (Estimated period)
            </th>
            <th className="evp-col-res">
              Internal / outsourced
              <br />
              evaluation resources
            </th>
            <th className="evp-col-std">
              Standards /
              <br />
              Procedures
            </th>
            <th className="evp-col-rem">Remarks</th>
            {!readOnly ? <th className="evp-col-actn" /> : null}
          </tr>
        </thead>
        <tbody>
          {!lines.length ? (
            <tr>
              <td colSpan={readOnly ? 6 : 7} className="evp-empty-hint">
                {readOnly
                  ? "No evaluation activities recorded."
                  : "Add activities from the dropdown — only the lines that apply."}
              </td>
            </tr>
          ) : (
            lines.map((line, index) => (
              <tr key={`act-${index}`}>
                <td className="evp-col-no">{index + 1}</td>
                <td className="evp-col-act">
                  {readOnly ? (
                    <span className="evp-dv">{line.name || "—"}</span>
                  ) : (
                    <Combobox
                      value={line.name || ""}
                      onChange={(v) => updateLine(index, { name: v })}
                      options={catalogOptions}
                      placeholder="Select activity…"
                      emptyMessage="No activities"
                      creatable
                    />
                  )}
                </td>
                <td>
                  <CellInput
                    type="date"
                    value={line.date}
                    readOnly={readOnly}
                    onChange={(v) => updateLine(index, { date: v })}
                  />
                </td>
                <td>
                  <CellInput
                    value={line.resource}
                    readOnly={readOnly}
                    placeholder="Internal / outsourced"
                    onChange={(v) => updateLine(index, { resource: v })}
                  />
                </td>
                <td>
                  <CellInput
                    value={line.standard}
                    readOnly={readOnly}
                    onChange={(v) => updateLine(index, { standard: v })}
                  />
                </td>
                <td>
                  <CellInput
                    value={line.remarks}
                    readOnly={readOnly}
                    onChange={(v) => updateLine(index, { remarks: v })}
                  />
                </td>
                {!readOnly ? (
                  <td className="evp-col-actn">
                    <button
                      type="button"
                      className="evp-trash"
                      aria-label="Remove activity"
                      onClick={() => removeLine(index)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))
          )}
          {!readOnly ? (
            <tr className="evp-add-row">
              <td colSpan={7}>
                <button
                  type="button"
                  className="evp-add-btn"
                  disabled={!canAdd}
                  onClick={addLine}
                >
                  <Plus size={14} /> Add activity
                </button>
                {!catalogOptions.length ? (
                  <span className="evp-hint">
                    {" "}
                    Standard Type-5 activities are built in.
                  </span>
                ) : null}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <table className="evp-sign-table">
        <tbody>
          <tr>
            <td className="evp-sig-cell">
              <div className="evp-sig-head">Created by:</div>
              <div className="evp-sig-details">
                Name: {values.preparedByName || "—"}
                <br />
                Position: {values.preparedByPosition || "—"}
                <br />
                Date: {values.preparedAt || "—"}
              </div>
            </td>
            <td className="evp-sig-cell">
              <div className="evp-sig-head">Approved by:</div>
              <div className="evp-sig-details">
                Name: {values.approvedByName || "—"}
                <br />
                Position: {values.approvedByPosition || "—"}
                <br />
                Date: {values.approvedAt || "—"}
              </div>
            </td>
            <td className="evp-sig-cell evp-remarks-cell">
              <div className="evp-sig-head">Remarks:</div>
              {readOnly || !canEdit("remarks") ? (
                <div className="evp-dv">{values.remarks || ""}</div>
              ) : (
                <textarea
                  className={`evp-textarea${
                    invalid.has("remarks") ? " evp-bad" : ""
                  }`}
                  rows={4}
                  value={values.remarks ?? ""}
                  onChange={(e) => setField("remarks", e.target.value)}
                />
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
