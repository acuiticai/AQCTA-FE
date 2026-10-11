import React, { useId, useState } from "react";

import { ChevronDownIcon, CloseIcon, EyeIcon, EyeOffIcon } from "./icons";

/**
 * Turns trailing / inline "*" markers into a prominent required indicator.
 * Used by every portal field label so required status is visually consistent.
 */
export function formatFieldLabel(label) {
  if (label == null || label === false) return null;
  if (typeof label !== "string") return label;
  if (!label.includes("*")) return label;

  return label.split(/(\*)/g).map((part, index) =>
    part === "*" ? (
      <span key={index} className="epc-field__required" aria-hidden="true">
        *
      </span>
    ) : (
      <React.Fragment key={index}>{part}</React.Fragment>
    ),
  );
}

/**
 * Label + control + error shell shared by every field in the portal.
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  full = false,
  size = "md",
  children,
}) {
  return (
    <div
      className={[
        "epc-field",
        size === "lg" ? "epc-field--lg" : "",
        error ? "epc-field--invalid" : "",
        full ? "epc-grid__full" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label && (
        <label className="epc-field__label" htmlFor={htmlFor}>
          {formatFieldLabel(label)}
        </label>
      )}
      {children}
      {error && <span className="epc-field__error">{error}</span>}
      {!error && hint && <span className="epc-field__hint">{hint}</span>}
    </div>
  );
}

export function TextField({
  label,
  error,
  hint,
  full = false,
  size = "md",
  id,
  className = "",
  ...rest
}) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <Field
      label={label}
      htmlFor={inputId}
      error={error}
      hint={hint}
      full={full}
      size={size}
    >
      <span className="epc-field__control">
        <input
          id={inputId}
          className={[
            "epc-input",
            size === "lg" ? "epc-input--lg" : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          aria-invalid={error ? "true" : undefined}
          {...rest}
        />
      </span>
    </Field>
  );
}

export function PasswordField({
  label,
  error,
  full = false,
  size = "md",
  id,
  ...rest
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <Field label={label} htmlFor={inputId} error={error} full={full} size={size}>
      <span className="epc-field__control">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          className={[
            "epc-input",
            "epc-input--has-affix",
            size === "lg" ? "epc-input--lg" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-invalid={error ? "true" : undefined}
          {...rest}
        />
        <button
          type="button"
          className="epc-field__affix"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </span>
    </Field>
  );
}

/**
 * `options` accepts strings or `{ value, label }` objects.
 * `placeholder` renders as a disabled first option so the control reads as
 * empty until the customer chooses, matching the Figma "Select …" state.
 */
export function SelectField({
  label,
  error,
  hint,
  full = false,
  size = "md",
  id,
  placeholder = "Select",
  options = [],
  value = "",
  ...rest
}) {
  const generatedId = useId();
  const selectId = id || generatedId;

  return (
    <Field
      label={label}
      htmlFor={selectId}
      error={error}
      hint={hint}
      full={full}
      size={size}
    >
      <span className="epc-field__control">
        <select
          id={selectId}
          className={["epc-select", size === "lg" ? "epc-select--lg" : ""]
            .filter(Boolean)
            .join(" ")}
          data-placeholder={value ? "false" : "true"}
          value={value}
          aria-invalid={error ? "true" : undefined}
          {...rest}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => {
            const optionValue =
              typeof option === "string" ? option : option.value;
            const optionLabel =
              typeof option === "string" ? option : option.label;
            return (
              <option key={optionValue} value={optionValue}>
                {optionLabel}
              </option>
            );
          })}
        </select>
        <span className="epc-select-caret" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </span>
    </Field>
  );
}

export function TextareaField({
  label,
  error,
  full = false,
  rows = 4,
  id,
  ...rest
}) {
  const generatedId = useId();
  const areaId = id || generatedId;

  return (
    <Field label={label} htmlFor={areaId} error={error} full={full}>
      <span className="epc-field__control">
        <textarea
          id={areaId}
          className="epc-textarea"
          rows={rows}
          aria-invalid={error ? "true" : undefined}
          {...rest}
        />
      </span>
    </Field>
  );
}

/**
 * Phone number as a dial-code picker plus the national number, which is what
 * "valid phone with country code selection" needs. The two report as one value
 * via `onChange({ dialCode, number })`.
 */
export function PhoneField({
  label,
  error,
  full = false,
  id,
  dialCodes = [],
  value = { dialCode: "", number: "" },
  onChange,
  placeholder = "Phone number",
  name,
}) {
  const generatedId = useId();
  const phoneId = id || generatedId;

  const update = (patch) => onChange?.({ ...value, ...patch });

  return (
    <Field label={label} htmlFor={phoneId} error={error} full={full}>
      <span className="epc-phone">
        <span className="epc-phone__code epc-field__control">
          <select
            className="epc-select"
            aria-label="Country dialling code"
            name={name ? `${name}DialCode` : undefined}
            data-placeholder={value.dialCode ? "false" : "true"}
            value={value.dialCode}
            onChange={(event) => update({ dialCode: event.target.value })}
          >
            <option value="" disabled>
              Code
            </option>
            {dialCodes.map((entry) => (
              <option key={entry.code} value={entry.dialCode}>
                {`${entry.code} ${entry.dialCode}`}
              </option>
            ))}
          </select>
          <span className="epc-select-caret" aria-hidden="true">
            <ChevronDownIcon />
          </span>
        </span>

        <span className="epc-phone__number epc-field__control">
          <input
            id={phoneId}
            className="epc-input"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            name={name}
            placeholder={placeholder}
            value={value.number}
            aria-invalid={error ? "true" : undefined}
            onChange={(event) => update({ number: event.target.value })}
          />
        </span>
      </span>
    </Field>
  );
}

/**
 * Free-text multi-value field: type a value and press Enter (or Add) to
 * append a removable chip. Used for Type(s), Model(s), Size(s), etc.
 */
export function MultiEntryField({
  label,
  error,
  hint,
  full = false,
  size = "md",
  id,
  name,
  values = [],
  onChange,
  placeholder = "Type and press Enter to add",
  addLabel = "Add",
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [draft, setDraft] = useState("");
  const list = Array.isArray(values)
    ? values.map((v) => String(v ?? "").trim()).filter(Boolean)
    : [];

  const commit = () => {
    const next = String(draft || "").trim();
    if (!next) return;
    const exists = list.some(
      (item) => item.toLowerCase() === next.toLowerCase(),
    );
    if (!exists) onChange?.([...list, next]);
    setDraft("");
  };

  const removeAt = (index) => {
    onChange?.(list.filter((_, i) => i !== index));
  };

  return (
    <Field
      label={label}
      htmlFor={inputId}
      error={error}
      hint={hint}
      full={full}
      size={size}
    >
      <div className="epc-multientry">
        {list.length > 0 ? (
          <div className="epc-multientry__chips" role="list">
            {list.map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="epc-multientry__chip"
                role="listitem"
              >
                <span className="epc-multientry__chip-label" title={item}>
                  {item}
                </span>
                <button
                  type="button"
                  className="epc-multientry__chip-remove"
                  aria-label={`Remove ${item}`}
                  onClick={() => removeAt(index)}
                >
                  <CloseIcon size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="epc-multientry__row">
          <span className="epc-field__control epc-multientry__input">
            <input
              id={inputId}
              name={name}
              className={[
                "epc-input",
                size === "lg" ? "epc-input--lg" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              value={draft}
              placeholder={placeholder}
              aria-invalid={error ? "true" : undefined}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commit();
                }
              }}
            />
          </span>
          <button
            type="button"
            className="epc-multientry__add"
            onClick={commit}
            disabled={!String(draft || "").trim()}
          >
            {addLabel}
          </button>
        </div>
      </div>
    </Field>
  );
}

export function FormGrid({ single = false, className = "", children }) {
  return (
    <div
      className={["epc-grid", single ? "epc-grid--single" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
