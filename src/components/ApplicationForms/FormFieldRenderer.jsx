import React from "react";

import {
  Field,
  TextField,
  TextareaField,
  FormGrid,
} from "@/customer/components/ui/Field";
import Button from "@/customer/components/ui/Button";
import Combobox from "@/customer/components/ui/Combobox";
import { isFieldVisible } from "@/components/ApplicationForms/fieldVisibility";
import InspectionCostingSheetForm from "@/components/ApplicationForms/InspectionCostingSheetForm";
import EvaluationPlanForm from "@/components/ApplicationForms/EvaluationPlanForm";
import CertificationCostingSheetForm from "@/components/ApplicationForms/CertificationCostingSheetForm";
import InspectorAppointmentLetterForm from "@/components/ApplicationForms/InspectorAppointmentLetterForm";
import EngineeringInspectionReviewForm from "@/components/ApplicationForms/EngineeringInspectionReviewForm";
import InspectionPreparationForm from "@/components/ApplicationForms/InspectionPreparationForm";
import InspectionPlanNoticeForm from "@/components/ApplicationForms/InspectionPlanNoticeForm";
import InspectionGuidelineForm from "@/components/ApplicationForms/InspectionGuidelineForm";
import InspectionNotesForm from "@/components/ApplicationForms/InspectionNotesForm";
import CertificationAssignmentLetterForm from "@/components/ApplicationForms/CertificationAssignmentLetterForm";
import DocAuditChecklistForm from "@/components/ApplicationForms/DocAuditChecklistForm";
import CertificationAcceptanceLetterForm from "@/components/ApplicationForms/CertificationAcceptanceLetterForm";
import CertificationAuditNoticeForm from "@/components/ApplicationForms/CertificationAuditNoticeForm";
import CertificationAuditChecklistAttendanceForm from "@/components/ApplicationForms/CertificationAuditChecklistAttendanceForm";
import CertificationAuditNotesForm from "@/components/ApplicationForms/CertificationAuditNotesForm";
import CertificationSelectedSamplesForm from "@/components/ApplicationForms/CertificationSelectedSamplesForm";
import CertificationAuditReportForm from "@/components/ApplicationForms/CertificationAuditReportForm";
import CertificationNonConformanceForm from "@/components/ApplicationForms/CertificationNonConformanceForm";
import CertificationProductTestingForm from "@/components/ApplicationForms/CertificationProductTestingForm";
import CertificationLabAcceptanceForm from "@/components/ApplicationForms/CertificationLabAcceptanceForm";
import CertificationReportForm from "@/components/ApplicationForms/CertificationReportForm";
import CertificationReportChangesForm from "@/components/ApplicationForms/CertificationReportChangesForm";
import CertificationRecommendationForm from "@/components/ApplicationForms/CertificationRecommendationForm";
import CertificateApprovalLetterForm from "@/components/ApplicationForms/CertificateApprovalLetterForm";
import CertificationDeliberationForm from "@/components/ApplicationForms/CertificationDeliberationForm";

/**
 * A value the system supplies rather than asks for.
 *
 * Bound fields mirror what the paper document shows without re-asking for it,
 * so they render as settled text rather than as a disabled input — a greyed
 * box invites a click that will never do anything.
 */
const ReadOnlyValue = ({ value, placeholder, preview }) => {
  const text = Array.isArray(value)
    ? value.filter(Boolean).join(", ")
    : String(value ?? "").trim();

  if (!text) {
    return (
      <span className="epc-readonly epc-readonly--empty">
        {placeholder || "—"}
      </span>
    );
  }

  return (
    <span className="epc-readonly">
      {text}
      {preview ? (
        <span className="epc-field__hint" style={{ marginLeft: 8 }}>
          (recorded when you submit)
        </span>
      ) : null}
    </span>
  );
};

/** A radio group, styled as selectable chips rather than bare dots. */
const ChoiceGroup = ({ field, value, editable, onChange, multiple = false }) => {
  const options = field.options || [];
  const selected = multiple
    ? Array.isArray(value)
      ? value
      : value
        ? [value]
        : []
    : String(value ?? "");

  const isOn = (option) =>
    multiple ? selected.includes(option) : selected === option;

  const toggle = (option) => {
    if (!editable) return;
    if (!multiple) {
      onChange?.(field.key, option);
      return;
    }
    onChange?.(
      field.key,
      selected.includes(option)
        ? selected.filter((o) => o !== option)
        : [...selected, option],
    );
  };

  /* Long option lists read better stacked; a Yes/No pair reads better in a
     row, so the layout follows the content rather than being fixed. */
  const stacked = options.some((o) => String(o).length > 28);

  return (
    <div className={`epc-choice${stacked ? " epc-choice--stack" : ""}`}>
      {options.map((option) => (
        <label
          key={option}
          className={[
            "epc-choice__option",
            isOn(option) ? "is-selected" : "",
            editable ? "" : "is-disabled",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <input
            type={multiple ? "checkbox" : "radio"}
            name={multiple ? `${field.key}_${option}` : field.key}
            checked={isOn(option)}
            disabled={!editable}
            onChange={() => toggle(option)}
          />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
};

/** Drop a leading "1. " / "2. " so check-point copy is not double-numbered. */
const stripLeadingNumber = (label) =>
  String(label || "").replace(/^\d+\.\s*/, "").trim();

/**
 * Contract-review check point: question + Y/N sit with the note on one row,
 * instead of a separate Description column opposite the radios.
 */
const CheckpointPair = ({
  resultField,
  descriptionField,
  values,
  resultEditable,
  descriptionEditable,
  resultInvalid,
  descriptionInvalid,
  onChange,
}) => {
  const question = stripLeadingNumber(resultField.label);
  const label =
    resultField.required && resultEditable ? `${question} *` : question;
  const noteId = `${descriptionField.key}_note`;

  return (
    <Field
      label={label}
      error={resultInvalid ? "This is required" : ""}
      full
    >
      <div className="epc-checkpoint">
        <ChoiceGroup
          field={resultField}
          value={values[resultField.key]}
          editable={resultEditable}
          onChange={onChange}
        />
        {descriptionEditable ? (
          <span className="epc-field__control epc-checkpoint__note">
            <input
              id={noteId}
              className={`epc-input${
                descriptionInvalid ? " is-invalid" : ""
              }`}
              type="text"
              placeholder={descriptionField.placeholder || "Optional note"}
              aria-label={
                stripLeadingNumber(descriptionField.label) || "Description"
              }
              value={values[descriptionField.key] ?? ""}
              onChange={(e) =>
                onChange?.(descriptionField.key, e.target.value)
              }
            />
          </span>
        ) : (
          <span className="epc-checkpoint__note">
            <ReadOnlyValue value={values[descriptionField.key]} />
          </span>
        )}
      </div>
    </Field>
  );
};

const FILE_MAX_BYTES = 10 * 1024 * 1024;
const FILE_ACCEPT_IMAGE = ".png,.jpg,.jpeg,image/png,image/jpeg";

const isImageMeta = (meta) => {
  const type = String(meta?.contentType || "").toLowerCase();
  if (type.startsWith("image/")) return true;
  const name = String(meta?.fileName || "").toLowerCase();
  return /\.(png|jpe?g|gif|webp)$/.test(name);
};

/** Image picker used by attachment rows on Inspection Notes. */
const FileUploadField = ({
  field,
  value,
  editable,
  invalid,
  onChange,
  attachmentUrlFor,
}) => {
  const imageRef = React.useRef(null);
  const [localError, setLocalError] = React.useState("");

  const displayLabel = "Image";
  const label = field.required && editable ? `${displayLabel} *` : displayLabel;
  const error = invalid ? "This is required" : localError;
  const full = field.colSpan === 2;
  const meta = value && typeof value === "object" ? value : null;
  const fileName = meta?.fileName || "";
  const purpose = meta?.purpose || field.key;
  const href =
    meta?.s3Key && attachmentUrlFor ? attachmentUrlFor(purpose) : "";
  const previewSrc =
    meta?.dataUrl && String(meta.dataUrl).startsWith("data:image/")
      ? meta.dataUrl
      : href && isImageMeta(meta)
        ? href
        : "";

  const pickFile = (file) => {
    setLocalError("");
    if (!file) return;
    const allowed = ["image/png", "image/jpeg", "image/jpg"];
    const type = String(file.type || "").toLowerCase();
    const nameOk = /\.(png|jpe?g)$/i.test(file.name || "");
    if (!allowed.includes(type) && !nameOk) {
      setLocalError("Use a PNG or JPEG image.");
      return;
    }
    if (file.size > FILE_MAX_BYTES) {
      setLocalError("Image is too large (max 10 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange?.(field.key, {
        dataUrl: String(reader.result || ""),
        fileName: file.name,
        contentType: file.type || "image/jpeg",
        size: file.size,
        purpose: field.key,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <Field
      label={label}
      hint={error ? "" : "PNG or JPEG (max 10 MB)."}
      error={error}
      full={full}
    >
      <div className="epc-file">
        {fileName ? (
          <div className="epc-file__picked">
            {previewSrc ? (
              <img
                className="epc-file__preview"
                src={previewSrc}
                alt={fileName}
              />
            ) : null}
            <div className="epc-file__current">
              {href ? (
                <a href={href} target="_blank" rel="noreferrer">
                  {fileName}
                </a>
              ) : (
                <span>{fileName}</span>
              )}
              {editable ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setLocalError("");
                    onChange?.(field.key, "");
                  }}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {editable ? (
          <div className="epc-file__actions">
            <Button
              variant="secondary"
              type="button"
              onClick={() => imageRef.current?.click()}
            >
              Upload image
            </Button>
            {!fileName ? (
              <span className="epc-file__hint">PNG or JPEG</span>
            ) : null}
            <input
              ref={imageRef}
              className="epc-file__hidden"
              type="file"
              accept={FILE_ACCEPT_IMAGE}
              capture="environment"
              aria-label="Upload image"
              onChange={(event) => {
                pickFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
        ) : !fileName ? (
          <span className="epc-readonly epc-readonly--empty">—</span>
        ) : null}
      </div>
    </Field>
  );
};

/** One field, in whichever control its type calls for. */
const FormField = ({
  field,
  value,
  editable,
  invalid,
  placeholder,
  preview,
  onChange,
  attachmentUrlFor,
}) => {
  const label = field.required && editable ? `${field.label} *` : field.label;
  const error = invalid ? "This is required" : "";
  const full = field.colSpan === 2;

  if (field.type === "file") {
    return (
      <FileUploadField
        field={field}
        value={value}
        editable={editable}
        invalid={invalid}
        onChange={onChange}
        attachmentUrlFor={attachmentUrlFor}
      />
    );
  }

  if (!editable) {
    return (
      <Field label={label} hint={field.helpText} full={full}>
        <ReadOnlyValue value={value} placeholder={placeholder} preview={preview} />
      </Field>
    );
  }

  const common = {
    label,
    error,
    hint: error ? "" : field.helpText,
    full,
  };

  switch (field.type) {
    case "radio":
      return (
        <Field {...common}>
          <ChoiceGroup
            field={field}
            value={value}
            editable
            onChange={onChange}
          />
        </Field>
      );

    case "checkboxes":
      return (
        <Field {...common}>
          <ChoiceGroup
            field={field}
            value={value}
            editable
            multiple
            onChange={onChange}
          />
        </Field>
      );

    /* A lone checkbox is a yes/no, so it reads as one statement to agree
       with rather than as a group of one. */
    case "checkbox":
      return (
        <Field {...common} label="">
          <div className="epc-choice">
            <label
              className={`epc-choice__option${
                String(value) === "true" ? " is-selected" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={String(value) === "true"}
                onChange={(e) =>
                  onChange?.(field.key, e.target.checked ? "true" : "")
                }
              />
              <span>{field.label}</span>
            </label>
          </div>
        </Field>
      );

    case "select":
      /* Custom listbox instead of native <select> — OS menus can't match the
         portal field chrome (and look especially out of place on costing). */
      return (
        <Combobox
          {...common}
          placeholder={field.placeholder || "Choose one…"}
          options={field.options || []}
          value={value ?? ""}
          searchable={false}
          clearable={!field.required}
          onChange={(next) => onChange?.(field.key, next)}
        />
      );

    case "textarea":
      return (
        <TextareaField
          {...common}
          rows={3}
          placeholder={field.placeholder}
          value={value ?? ""}
          onChange={(e) => onChange?.(field.key, e.target.value)}
        />
      );

    case "number":
      return (
        <TextField
          {...common}
          type="number"
          inputMode="decimal"
          step="0.01"
          placeholder={field.placeholder}
          value={value ?? ""}
          onChange={(e) => onChange?.(field.key, e.target.value)}
        />
      );

    case "date":
      return (
        <TextField
          {...common}
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange?.(field.key, e.target.value)}
        />
      );

    case "time":
      return (
        <TextField
          {...common}
          type="time"
          value={value ?? ""}
          onChange={(e) => onChange?.(field.key, e.target.value)}
        />
      );

    default:
      return (
        <TextField
          {...common}
          placeholder={field.placeholder}
          value={value ?? ""}
          onChange={(e) => onChange?.(field.key, e.target.value)}
        />
      );
  }
};

/**
 * Dynamic Forms stores one composite label per cell
 * ("1. Standard Suitability Study — Planned date"). The table needs the
 * activity name and the column title separately; split only on — / – so
 * hyphens inside the activity name stay intact.
 */
const parseMatrixCompositeLabel = (label) => {
  let rest = String(label || "").trim();
  rest = rest.replace(/^\d+\.\s*/, "");
  const match = rest.match(/^(.*?)\s*[—–]\s*(.+)$/);
  if (match) {
    return { rowLabel: match[1].trim(), columnLabel: match[2].trim() };
  }
  return { rowLabel: rest, columnLabel: "" };
};

/**
 * A fixed table: the same few questions asked of every row.
 *
 * Rendered as the table the master prints rather than as one labelled input
 * per cell — the evaluation plan asks four things about each of nine
 * activities, and stacked that is thirty-six fields whose labels are mostly
 * the activity name repeated back.
 *
 * Row / column wording comes from the live field labels (Settings → Dynamic
 * Forms), not only from the seeded matrix copy, so a rename shows here and
 * on the PDF the same way.
 *
 * Values stay under the same flat keys the server and the PDF already read
 * (`act_3_resource`), so nothing behind this changes.
 */
const MatrixSection = ({
  section,
  fields = [],
  values,
  readOnly,
  invalidKeys = [],
  onChange,
}) => {
  const { keyPrefix, rows = [], columns = [] } = section.matrix;
  const invalid = new Set(invalidKeys);

  const rowLabelOf = (row) => {
    const prefer = fields.find((f) => f.key === `${keyPrefix}_${row.key}_date`);
    const any = fields.find((f) =>
      String(f.key || "").startsWith(`${keyPrefix}_${row.key}_`),
    );
    const source = prefer || any;
    if (!source?.label) return row.label || "";
    const { rowLabel } = parseMatrixCompositeLabel(source.label);
    return rowLabel || row.label || "";
  };

  const columnLabelOf = (column) => {
    for (const row of rows) {
      const field = fields.find(
        (f) => f.key === `${keyPrefix}_${row.key}_${column.key}`,
      );
      if (!field?.label) continue;
      const { columnLabel } = parseMatrixCompositeLabel(field.label);
      if (columnLabel) return columnLabel;
    }
    return column.label || "";
  };

  return (
    <section className="epc-section">
      <header className="epc-section__head">
        <h3 className="epc-section__title">{section.title}</h3>
        {section.description ? (
          <p className="epc-section__desc">{section.description}</p>
        ) : null}
      </header>

      <div className="epc-matrix__wrap">
        <table className="epc-matrix">
          <thead>
            <tr>
              <th className="epc-matrix__no" scope="col">
                No.
              </th>
              <th scope="col">Activity</th>
              {columns.map((column) => (
                <th key={column.key} scope="col">
                  {columnLabelOf(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const activityLabel = rowLabelOf(row);
              return (
                <tr key={row.key}>
                  <td className="epc-matrix__no">{index + 1}</td>
                  <th scope="row" className="epc-matrix__rowlabel">
                    {activityLabel}
                  </th>
                  {columns.map((column) => {
                    const key = `${keyPrefix}_${row.key}_${column.key}`;
                    const columnLabel = columnLabelOf(column);
                    return (
                      <td key={key}>
                        {readOnly ? (
                          <span className="epc-matrix__value">
                            {String(values[key] ?? "").trim() || "—"}
                          </span>
                        ) : (
                          <input
                            className={`epc-input epc-matrix__input${
                              invalid.has(key) ? " is-invalid" : ""
                            }`}
                            type={column.type === "date" ? "date" : "text"}
                            value={values[key] ?? ""}
                            aria-label={`${activityLabel} — ${columnLabel}`}
                            onChange={(e) => onChange?.(key, e.target.value)}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

/**
 * A section that holds as many rows as the work needs.
 *
 * Rows are stored as flat keys (`extra_2_resource`), which is what both the
 * server and the PDF stamper read, so the shape here matches the storage
 * rather than being flattened on the way out.
 */
const RepeatableSection = ({
  section,
  values,
  rowCount,
  readOnly,
  invalidKeys = [],
  onAddRow,
  onRemoveRow,
  onChange,
  attachmentUrlFor,
}) => {
  const { keyPrefix, fields = [], max = 8, addLabel, rowLabel } = section.repeatable;
  const invalid = new Set(invalidKeys);

  return (
    <section className="epc-section">
      <header className="epc-section__head">
        <h3 className="epc-section__title">{section.title}</h3>
        {section.description ? (
          <p className="epc-section__desc">{section.description}</p>
        ) : null}
      </header>

      {Array.from({ length: rowCount }, (_, i) => i + 1).map((index) => (
        <div className="epc-repeat" key={index}>
          <div className="epc-repeat__head">
            <span className="epc-repeat__label">
              {rowLabel || "Row"} {index}
            </span>
            {!readOnly ? (
              <Button
                variant="ghost"
                onClick={() => onRemoveRow?.(index)}
                aria-label={`Remove ${rowLabel || "row"} ${index}`}
              >
                Remove
              </Button>
            ) : null}
          </div>
          <FormGrid>
            {fields.map((rowField) => {
              const key = `${keyPrefix}_${index}_${rowField.key}`;
              return (
                <FormField
                  key={key}
                  field={{ ...rowField, key }}
                  value={values[key]}
                  editable={!readOnly}
                  invalid={invalid.has(key)}
                  onChange={onChange}
                  attachmentUrlFor={attachmentUrlFor}
                />
              );
            })}
          </FormGrid>
        </div>
      ))}

      {!readOnly && rowCount < max ? (
        <Button variant="secondary" onClick={onAddRow}>
          {addLabel || "Add row"}
        </Button>
      ) : null}

      {readOnly && rowCount === 0 ? (
        <p className="epc-section__desc">Nothing added.</p>
      ) : null}
    </section>
  );
};

/**
 * Costing Sheet fee lines — driven by catalogue Items ticked in Dynamic Forms.
 * Leave an amount blank to skip that line on totals and on the PDF.
 */
const FeeLinesSection = ({ lines = [], readOnly, onChange }) => {
  const updateAmount = (itemId, amount) => {
    if (readOnly) return;
    const next = lines.map((line) =>
      String(line.itemId) === String(itemId) ? { ...line, amount } : line,
    );
    onChange?.("feeLines", next);
  };

  if (!lines.length) {
    return (
      <p className="epc-section__desc">
        No fee items are configured. Tick catalogue Items under Settings →
        Dynamic Forms → Costing Sheet → Fees (RM).
      </p>
    );
  }

  if (readOnly) {
    return (
      <FormGrid>
        {lines.map((line) => (
          <Field
            key={line.itemId || line.itemCode || line.name}
            label={line.name || line.itemCode || "Fee"}
            full
          >
            <ReadOnlyValue
              value={line.amount}
              placeholder="—"
            />
          </Field>
        ))}
      </FormGrid>
    );
  }

  return (
    <FormGrid>
      {lines.map((line) => (
        <TextField
          key={line.itemId || line.itemCode || line.name}
          label={line.name || line.itemCode || "Fee"}
          type="number"
          inputMode="decimal"
          step="0.01"
          placeholder="0.00"
          hint={
            line.itemCode
              ? `${line.itemCode} — leave blank if this line does not apply`
              : "Leave blank if this line does not apply"
          }
          full
          value={line.amount ?? ""}
          onChange={(e) => updateAmount(line.itemId, e.target.value)}
        />
      ))}
    </FormGrid>
  );
};

/**
 * Inspection costing staff manhours — manhour cost (RM) × hours → line total.
 */
const ManhourLinesSection = ({ lines = [], readOnly, onChange }) => {
  const updateLine = (itemId, patch) => {
    if (readOnly) return;
    const next = lines.map((line) => {
      if (String(line.itemId) !== String(itemId)) return line;
      const merged = { ...line, ...patch };
      const cost = Number(String(merged.manhourCost ?? "").replace(/[^0-9.-]/g, "")) || 0;
      const hours = Number(String(merged.hours ?? "").replace(/[^0-9.-]/g, "")) || 0;
      const hasParts =
        String(merged.manhourCost ?? "").trim() !== "" ||
        String(merged.hours ?? "").trim() !== "";
      return {
        ...merged,
        amount: hasParts ? String(cost * hours) : "",
      };
    });
    onChange?.("feeLines", next);
  };

  if (!lines.length) {
    return (
      <p className="epc-section__desc">
        No Staff Manhours items found. Create Items under category
        &quot;Staff Manhours&quot; in /items.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {lines.map((line) => {
        const cost = Number(String(line.manhourCost ?? "").replace(/[^0-9.-]/g, "")) || 0;
        const hours = Number(String(line.hours ?? "").replace(/[^0-9.-]/g, "")) || 0;
        const total =
          String(line.manhourCost ?? "").trim() !== "" ||
          String(line.hours ?? "").trim() !== ""
            ? (cost * hours).toLocaleString("en-MY", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "—";
        return (
          <div
            key={line.itemId || line.itemCode || line.name}
            style={{
              border: "1px solid var(--epc-border, #e5e7eb)",
              borderRadius: 8,
              padding: 12,
            }}
          >
            <div
              style={{
                fontWeight: 600,
                marginBottom: 8,
                fontSize: 14,
              }}
            >
              {line.name || line.itemCode || "Staff"}
              {line.itemCode ? (
                <span
                  style={{
                    fontWeight: 400,
                    color: "#6b7280",
                    marginLeft: 8,
                    fontSize: 12,
                  }}
                >
                  {line.itemCode}
                </span>
              ) : null}
            </div>
            {readOnly ? (
              <FormGrid>
                <Field label="Manhour cost (RM)">
                  <ReadOnlyValue value={line.manhourCost} placeholder="—" />
                </Field>
                <Field label="Hours">
                  <ReadOnlyValue value={line.hours} placeholder="—" />
                </Field>
                <Field label="Total (RM)">
                  <ReadOnlyValue value={total} placeholder="—" />
                </Field>
              </FormGrid>
            ) : (
              <FormGrid>
                <TextField
                  label="Manhour cost (RM)"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0.00"
                  value={line.manhourCost ?? ""}
                  onChange={(e) =>
                    updateLine(line.itemId, { manhourCost: e.target.value })
                  }
                />
                <TextField
                  label="Hours"
                  type="number"
                  inputMode="decimal"
                  step="0.25"
                  placeholder="0"
                  hint="Nearest 15 minutes"
                  value={line.hours ?? ""}
                  onChange={(e) =>
                    updateLine(line.itemId, { hours: e.target.value })
                  }
                />
                <Field label="Total (RM)">
                  <ReadOnlyValue value={total} placeholder="—" />
                </Field>
              </FormGrid>
            )}
          </div>
        );
      })}
    </div>
  );
};

/**
 * Renders a form template.
 *
 * @param {object}   template     ApplicationFormTemplate
 * @param {object}   values       resolved values, bound and manual alike
 * @param {string[]} editableKeys keys the current user may type into
 * @param {string[]} invalidKeys  keys the server rejected on submit
 * @param {boolean}  readOnly     force every field read-only (approver view)
 * @param {object}   placeholders per-key hint shown when a bound value is empty
 * @param {boolean}  preview      bound sign-off values are a preview, not fact
 */
const FormFieldRenderer = ({
  template,
  values = {},
  editableKeys = [],
  invalidKeys = [],
  readOnly = false,
  placeholders = {},
  preview = false,
  repeatableRows = {},
  onAddRow,
  onRemoveRow,
  onChange,
  attachmentUrlFor,
  fetchAttachmentBlob,
  feeCatalogItems = [],
  serviceOptions = [],
  activityCatalog = [],
  preparedSignature = "",
  onPreparedSignatureChange,
  profileSignature = "",
  preparedSignatureUrl = "",
  auditorSignatureUrl = "",
  customerSignatureUrl = "",
  attendanceSyncKey = "",
  documentTitle = "",
  documentCode = "",
}) => {
  const editable = new Set(editableKeys);
  const invalid = new Set(invalidKeys);
  const fields = [...(template?.fields || [])]
    /* Resolved for the document but never shown: the sign-off block records
       who prepared and approved the form as those things happen, so there is
       nothing here for anyone to read while filling it in. */
    .filter((field) => !field.hidden)
    /* Settings-only fields (e.g. feeCatalog) are edited under Dynamic Forms. */
    .filter((field) => !field.settingsOnly)
    // A field whose condition is unmet is not rendered at all — the server
    // applies the same rule, so it is neither required nor saved.
    .filter((field) => isFieldVisible(field, values))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const sections = [...(template?.sections || [])].sort(
    (a, b) => (a.order || 0) - (b.order || 0),
  );

  /* Inspection costing uses a PDF-shaped sheet instead of generic sections. */
  if (template?.formKey === "FOR-06-02") {
    const servicesField = (template.fields || []).find(
      (f) => f.key === "servicesRequired",
    );
    const fromField = Array.isArray(servicesField?.options)
      ? servicesField.options
      : [];
    return (
      <InspectionCostingSheetForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        feeCatalogItems={feeCatalogItems}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
        servicesRequiredOptions={
          fromField.length
            ? fromField
            : Array.isArray(serviceOptions)
              ? serviceOptions
              : []
        }
        servicesRequiredPlaceholder={
          servicesField?.placeholder || "Select inspection service"
        }
        preparedSignature={preparedSignature}
        onPreparedSignatureChange={onPreparedSignatureChange}
        profileSignature={profileSignature}
        preparedSignatureUrl={preparedSignatureUrl}
      />
    );
  }

  /* Certification evaluation plan — same HTML/CSS sheet as the PDF. */
  if (template?.formKey === "FOR-01-25") {
    return (
      <EvaluationPlanForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
        activityCatalog={activityCatalog}
      />
    );
  }

  /* Certification costing — PDF-shaped sheet with dropdown fee lines. */
  if (template?.formKey === "FOR-01-06") {
    return (
      <CertificationCostingSheetForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        feeCatalogItems={feeCatalogItems}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
        documentTitle={documentTitle}
        documentCode={documentCode}
      />
    );
  }

  /* Inspection appointment letter — same HTML/CSS sheet as the PDF. */
  if (template?.formKey === "FOR-06-06") {
    const coordinatorField = (template.fields || []).find(
      (f) => f.key === "assignedCoordinator",
    );
    const fromField = Array.isArray(coordinatorField?.options)
      ? coordinatorField.options
      : [];
    return (
      <InspectorAppointmentLetterForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
        coordinatorOptions={fromField}
        preparedSignature={preparedSignature}
        onPreparedSignatureChange={onPreparedSignatureChange}
        profileSignature={profileSignature}
        preparedSignatureUrl={preparedSignatureUrl}
      />
    );
  }

  /* Engineering inspection review checklist — same HTML/CSS as the PDF. */
  if (template?.formKey === "FOR-06-05") {
    return (
      <EngineeringInspectionReviewForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
      />
    );
  }

  /* Inspection preparation checklist — same HTML/CSS as the PDF. */
  if (template?.formKey === "FOR-06-07-03") {
    return (
      <InspectionPreparationForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
      />
    );
  }

  /* Inspection plan notice — same HTML/CSS as the PDF. */
  if (template?.formKey === "FOR-06-07-02") {
    const typeField = (template.fields || []).find(
      (f) => f.key === "inspectionType",
    );
    const typeOptions = Array.isArray(typeField?.options)
      ? typeField.options
      : [];
    return (
      <InspectionPlanNoticeForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
        inspectionTypeOptions={typeOptions}
      />
    );
  }

  /* Inspection guideline — same HTML/CSS as the PDF. */
  if (template?.formKey === "FOR-06-11") {
    return (
      <InspectionGuidelineForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
      />
    );
  }

  /* Inspection notes — same HTML/CSS as the PDF (multi-page sheet). */
  if (template?.formKey === "FOR-06-07") {
    const sectionByKey = Object.fromEntries(
      (template.sections || []).map((s) => [s.key, s]),
    );
    return (
      <InspectionNotesForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
        repeatableRows={repeatableRows}
        onAddRow={(sectionKey) => {
          const section = sectionByKey[sectionKey];
          if (section) onAddRow?.(section);
        }}
        onRemoveRow={(sectionKey, index) => {
          const section = sectionByKey[sectionKey];
          if (section) onRemoveRow?.(section, index);
        }}
        attachmentUrlFor={attachmentUrlFor}
        fetchAttachmentBlob={fetchAttachmentBlob}
      />
    );
  }

  /* Certification assignment letter — same HTML/CSS as the PDF. */
  if (template?.formKey === "FOR-01-10") {
    return (
      <CertificationAssignmentLetterForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
        preparedSignature={preparedSignature}
        onPreparedSignatureChange={onPreparedSignatureChange}
        profileSignature={profileSignature}
        preparedSignatureUrl={preparedSignatureUrl}
        auditorSignatureUrl={auditorSignatureUrl}
        documentTitle={documentTitle}
        documentCode={documentCode}
      />
    );
  }

  /* Documentation audit checklist — same HTML/CSS as the PDF. */
  if (template?.formKey === "FOR-01-08") {
    return (
      <DocAuditChecklistForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
        preparedSignature={preparedSignature}
        onPreparedSignatureChange={onPreparedSignatureChange}
        profileSignature={profileSignature}
        preparedSignatureUrl={preparedSignatureUrl}
        documentTitle={documentTitle}
        documentCode={documentCode}
      />
    );
  }

  /* Acceptance letter — same HTML/CSS as the PDF. */
  if (template?.formKey === "FOR-01-09") {
    return (
      <CertificationAcceptanceLetterForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
        preparedSignature={preparedSignature}
        onPreparedSignatureChange={onPreparedSignatureChange}
        profileSignature={profileSignature}
        preparedSignatureUrl={preparedSignatureUrl}
        documentTitle={documentTitle}
        documentCode={documentCode}
      />
    );
  }

  /* Factory audit notice — same HTML/CSS as the PDF. */
  if (template?.formKey === "FOR-01-11") {
    return (
      <CertificationAuditNoticeForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
        preparedSignature={preparedSignature}
        onPreparedSignatureChange={onPreparedSignatureChange}
        profileSignature={profileSignature}
        preparedSignatureUrl={preparedSignatureUrl}
        customerSignatureUrl={customerSignatureUrl}
        documentTitle={documentTitle}
        documentCode={documentCode}
      />
    );
  }

  /* Audit checklist and attendance list — same HTML/CSS as the PDF. */
  if (template?.formKey === "FOR-01-12") {
    const sectionByKey = Object.fromEntries(
      (template.sections || []).map((s) => [s.key, s]),
    );
    return (
      <CertificationAuditChecklistAttendanceForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
        repeatableRows={repeatableRows}
        onAddRow={(sectionKey) => {
          const section = sectionByKey[sectionKey];
          if (section) onAddRow?.(section);
        }}
        onRemoveRow={(sectionKey, index) => {
          const section = sectionByKey[sectionKey];
          if (section) onRemoveRow?.(section, index);
        }}
        preparedSignature={preparedSignature}
        onPreparedSignatureChange={onPreparedSignatureChange}
        profileSignature={profileSignature}
        preparedSignatureUrl={preparedSignatureUrl}
        attendanceSyncKey={attendanceSyncKey}
        documentTitle={documentTitle}
        documentCode={documentCode}
      />
    );
  }

  /* Audit notes — same HTML/CSS as the PDF. */
  if (template?.formKey === "FOR-01-13") {
    const sectionByKey = Object.fromEntries(
      (template.sections || []).map((s) => [s.key, s]),
    );
    return (
      <CertificationAuditNotesForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
        repeatableRows={repeatableRows}
        onAddRow={(sectionKey) => {
          const section = sectionByKey[sectionKey];
          if (section) onAddRow?.(section);
        }}
        onRemoveRow={(sectionKey, index) => {
          const section = sectionByKey[sectionKey];
          if (section) onRemoveRow?.(section, index);
        }}
        preparedSignature={preparedSignature}
        onPreparedSignatureChange={onPreparedSignatureChange}
        profileSignature={profileSignature}
        preparedSignatureUrl={preparedSignatureUrl}
        documentTitle={documentTitle}
        documentCode={documentCode}
      />
    );
  }

  /* Selected samples — landscape sheet matching the PDF. */
  if (template?.formKey === "FOR-01-15") {
    return (
      <CertificationSelectedSamplesForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
        preparedSignature={preparedSignature}
        onPreparedSignatureChange={onPreparedSignatureChange}
        profileSignature={profileSignature}
        preparedSignatureUrl={preparedSignatureUrl}
      />
    );
  }

  /* Audit report — customer-facing 2-page report. */
  if (template?.formKey === "FOR-01-16") {
    return (
      <CertificationAuditReportForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
        preparedSignature={preparedSignature}
        onPreparedSignatureChange={onPreparedSignatureChange}
        profileSignature={profileSignature}
        preparedSignatureUrl={preparedSignatureUrl}
        customerSignatureUrl={customerSignatureUrl}
        documentTitle={documentTitle}
        documentCode={documentCode}
      />
    );
  }

  /* Non-conformance report — customer-facing NCR. */
  if (template?.formKey === "FOR-01-14") {
    return (
      <CertificationNonConformanceForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
        preparedSignature={preparedSignature}
        onPreparedSignatureChange={onPreparedSignatureChange}
        profileSignature={profileSignature}
        preparedSignatureUrl={preparedSignatureUrl}
        customerSignatureUrl={customerSignatureUrl}
        documentTitle={documentTitle}
        documentCode={documentCode}
      />
    );
  }

  /* Product testing requisition — customer-facing. */
  if (template?.formKey === "FOR-01-17") {
    return (
      <CertificationProductTestingForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
        preparedSignature={preparedSignature}
        onPreparedSignatureChange={onPreparedSignatureChange}
        profileSignature={profileSignature}
        preparedSignatureUrl={preparedSignatureUrl}
        customerSignatureUrl={customerSignatureUrl}
      />
    );
  }

  /* Lab acceptance — auditor records laboratory authorised signature. */
  if (template?.formKey === "FOR-01-18") {
    return (
      <CertificationLabAcceptanceForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
        preparedSignature={preparedSignature}
        onPreparedSignatureChange={onPreparedSignatureChange}
        profileSignature={profileSignature}
        preparedSignatureUrl={preparedSignatureUrl}
      />
    );
  }

  /* Certification report — auditor prepares; digital approval by a second user. */
  if (template?.formKey === "FOR-01-19") {
    return (
      <CertificationReportForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
        documentTitle={documentTitle}
        documentCode={documentCode}
      />
    );
  }

  /* Certification report changes — list of changes to report / licence. */
  if (template?.formKey === "FOR-01-19.1") {
    const sectionByKey = Object.fromEntries(
      (template.sections || []).map((s) => [s.key, s]),
    );
    return (
      <CertificationReportChangesForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        repeatableRows={repeatableRows}
        onAddRow={(sectionKey) => {
          const section = sectionByKey[sectionKey];
          if (section) onAddRow?.(section);
        }}
        onRemoveRow={(sectionKey, index) => {
          const section = sectionByKey[sectionKey];
          if (section) onRemoveRow?.(section, index);
        }}
      />
    );
  }

  /* Certification recommendation — review checklist + digital approval. */
  if (template?.formKey === "FOR-01-19.2") {
    const sectionByKey = Object.fromEntries(
      (template.sections || []).map((s) => [s.key, s]),
    );
    return (
      <CertificationRecommendationForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
        repeatableRows={repeatableRows}
        onAddRow={(sectionKey) => {
          const section = sectionByKey[sectionKey];
          if (section) onAddRow?.(section);
        }}
        onRemoveRow={(sectionKey, index) => {
          const section = sectionByKey[sectionKey];
          if (section) onRemoveRow?.(section, index);
        }}
        documentTitle={documentTitle}
        documentCode={documentCode}
      />
    );
  }

  /* Certificate approval letter — licence approval notice + digital approval. */
  if (template?.formKey === "FOR-01-19.3") {
    return (
      <CertificateApprovalLetterForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
        documentTitle={documentTitle}
        documentCode={documentCode}
      />
    );
  }

  /* Certification panel deliberation — case + decision + digital approval. */
  if (template?.formKey === "FOR-01-20") {
    return (
      <CertificationDeliberationForm
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        invalidKeys={invalidKeys}
        editableKeys={editableKeys}
        documentTitle={documentTitle}
        documentCode={documentCode}
      />
    );
  }

  // Fields whose section was removed from the template still need a home.
  const known = new Set(sections.map((s) => s.key));
  const orphans = fields.filter((f) => !known.has(f.sectionKey));
  const groups = [
    ...sections.map((section) => ({
      section,
      items: fields.filter((f) => f.sectionKey === section.key),
    })),
    ...(orphans.length
      ? [{ section: { key: "__other", title: "Other" }, items: orphans }]
      : []),
  ].filter(
    (g) =>
      g.items.length ||
      g.section.repeatable ||
      g.section.matrix ||
      (g.section.key === "fees" &&
        (template?.formKey === "FOR-01-06" ||
          template?.formKey === "FOR-06-02")),
  );

  return (
    <div>
      {groups.map(({ section, items }) =>
        section.matrix ? (
          <MatrixSection
            key={section.key}
            section={section}
            fields={items}
            values={values}
            readOnly={readOnly}
            invalidKeys={invalidKeys}
            onChange={onChange}
          />
        ) : section.repeatable ? (
          <RepeatableSection
            key={section.key}
            section={section}
            values={values}
            rowCount={repeatableRows[section.key] || 0}
            readOnly={readOnly}
            invalidKeys={invalidKeys}
            onAddRow={() => onAddRow?.(section)}
            onRemoveRow={(index) => onRemoveRow?.(section, index)}
            onChange={onChange}
            attachmentUrlFor={attachmentUrlFor}
          />
        ) : (
          <section className="epc-section" key={section.key}>
            <header className="epc-section__head">
              <h3 className="epc-section__title">{section.title}</h3>
              {section.description ? (
                <p className="epc-section__desc">{section.description}</p>
              ) : null}
            </header>
            {section.key === "fees" && template?.formKey === "FOR-01-06" ? (
              <div style={{ marginBottom: 16 }}>
                <FeeLinesSection
                  lines={Array.isArray(values.feeLines) ? values.feeLines : []}
                  readOnly={readOnly}
                  onChange={onChange}
                />
              </div>
            ) : null}
            {section.key === "fees" && template?.formKey === "FOR-06-02" ? (
              <div style={{ marginBottom: 16 }}>
                <ManhourLinesSection
                  lines={Array.isArray(values.feeLines) ? values.feeLines : []}
                  readOnly={readOnly}
                  onChange={onChange}
                />
              </div>
            ) : null}
            <FormGrid>
              {(() => {
                const byKey = new Map(items.map((f) => [f.key, f]));
                const skip = new Set();
                const nodes = [];
                for (const field of items) {
                  if (skip.has(field.key)) continue;
                  const pair = String(field.key || "").match(
                    /^check_(\d+)_result$/,
                  );
                  const note =
                    pair && byKey.get(`check_${pair[1]}_description`);
                  if (pair && note) {
                    skip.add(note.key);
                    nodes.push(
                      <CheckpointPair
                        key={field.key}
                        resultField={field}
                        descriptionField={note}
                        values={values}
                        resultEditable={
                          !readOnly && editable.has(field.key)
                        }
                        descriptionEditable={
                          !readOnly && editable.has(note.key)
                        }
                        resultInvalid={invalid.has(field.key)}
                        descriptionInvalid={invalid.has(note.key)}
                        onChange={onChange}
                      />,
                    );
                    continue;
                  }
                  nodes.push(
                    <FormField
                      key={field.key}
                      field={field}
                      value={values[field.key]}
                      editable={!readOnly && editable.has(field.key)}
                      invalid={invalid.has(field.key)}
                      placeholder={placeholders[field.key]}
                      preview={preview && field.key.startsWith("prepared")}
                      onChange={onChange}
                      attachmentUrlFor={attachmentUrlFor}
                    />,
                  );
                }
                return nodes;
              })()}
            </FormGrid>
          </section>
        ),
      )}
    </div>
  );
};

export default FormFieldRenderer;
