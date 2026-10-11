import React from "react";
import {
  InputFieldWithLabel,
  InputField,
  DropdownBasic,
  CustomDatePicker,
  TextArea,
  Checkbox,
} from "@/page-layouts/index";
import FieldHelpHint from "./FieldHelpHint";

function toLocalDateString(d) {
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalDatetimeLocalString(d) {
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/**
 * Renders one custom field using the same primitives as FormInput / native screens.
 */
export default function CustomFieldDefinitionControl({
  definition: d,
  value: v,
  onPatch,
  readOnly = false,
  profile,
  fieldError,
  uploadFile,
}) {
  const direction = profile?.layout?.labelDirection ?? "column";
  const customLabelWidth = profile?.layout?.customLabelWidth ?? "w-full";
  const err = fieldError || "";
  const shouldShowError = !!fieldError;
  const ph = d.input_format != null ? String(d.input_format) : "";
  const helpIcon = d.help_text?.trim() ? (
    <FieldHelpHint text={d.help_text} />
  ) : null;
  const labelWithHint = (
    <span className="inline-flex items-center gap-1.5">
      {d.label}
      {helpIcon}
    </span>
  );
  const privacyDescription =
    d.data_privacy && d.data_privacy !== "none"
      ? `Privacy: ${d.data_privacy}`
      : null;

  const useDoc = profile?.controlSurface === "document";
  const fieldTheme = readOnly ? "gray" : useDoc ? "invoice" : "gray";
  const useTightLabelInputSpacing =
    useDoc || Boolean(profile?.layout?.tightLabelInputSpacing);
  const docLayoutProps = useTightLabelInputSpacing
    ? { tightLabelInputSpacing: true }
    : {};

  if (d.data_type === "checkbox") {
    return (
      <InputFieldWithLabel
        label={labelWithHint}
        required={d.is_required}
        direction={direction}
        customLabelWidth={customLabelWidth}
        {...docLayoutProps}
        description={privacyDescription || undefined}
        error={err}
        shouldShowError={shouldShowError}
        Input={
          <Checkbox
            value={!!v}
            disabled={readOnly}
            onChange={(checked) => onPatch(d.field_key, checked)}
            label=""
          />
        }
      />
    );
  }

  if (d.data_type === "multi_line_text" || d.data_type === "formula") {
    return (
      <InputFieldWithLabel
        label={labelWithHint}
        required={d.is_required}
        direction={direction}
        customLabelWidth={customLabelWidth}
        {...docLayoutProps}
        description={privacyDescription || undefined}
        error={err}
        shouldShowError={shouldShowError}
        Input={
          <TextArea
            name={d.field_key}
            value={v ?? ""}
            disabled={readOnly}
            readOnly={readOnly}
            rows={4}
            placeholder={ph}
            onChange={(e) => onPatch(d.field_key, e.target.value)}
            error={err}
            shouldShowError={shouldShowError}
            theme={fieldTheme}
          />
        }
      />
    );
  }

  if (d.data_type === "dropdown") {
    const options = [
      { value: "", label: ph.trim() || "—" },
      ...(d.options || []).map((opt) => ({ value: opt, label: opt })),
    ];
    return (
      <InputFieldWithLabel
        label={labelWithHint}
        required={d.is_required}
        direction={direction}
        customLabelWidth={customLabelWidth}
        {...docLayoutProps}
        description={privacyDescription || undefined}
        error={err}
        shouldShowError={shouldShowError}
        disabled={readOnly}
        Input={
          <DropdownBasic
            name={d.field_key}
            options={options}
            value={v ?? ""}
            onChange={(val) => onPatch(d.field_key, val ?? "")}
            placeholder={ph.trim() || "Select"}
            isDisabled={readOnly}
            isClearable
            sortOptions={false}
            error={err}
            shouldShowError={shouldShowError}
            appearance={useDoc ? "document" : "default"}
          />
        }
      />
    );
  }

  if (d.data_type === "multi_select") {
    const options = (d.options || []).map((opt) => ({
      value: opt,
      label: opt,
    }));
    const arr = Array.isArray(v) ? v : [];
    return (
      <InputFieldWithLabel
        label={labelWithHint}
        required={d.is_required}
        direction={direction}
        customLabelWidth={customLabelWidth}
        {...docLayoutProps}
        description={privacyDescription || undefined}
        error={err}
        shouldShowError={shouldShowError}
        disabled={readOnly}
        Input={
          <DropdownBasic
            name={d.field_key}
            options={options}
            value={arr}
            isMulti
            onChange={(val) => {
              const next = Array.isArray(val) ? val : [];
              onPatch(d.field_key, next);
            }}
            placeholder={ph.trim() || "Select options"}
            isDisabled={readOnly}
            sortOptions={false}
            error={err}
            shouldShowError={shouldShowError}
            appearance={useDoc ? "document" : "default"}
          />
        }
      />
    );
  }

  if (d.data_type === "date" || d.data_type === "datetime") {
    const showTime = d.data_type === "datetime";
    const selected =
      v && (typeof v === "string" || v instanceof Date)
        ? new Date(v)
        : null;
    const valid = selected && !Number.isNaN(selected.getTime());

    return (
      <InputFieldWithLabel
        label={labelWithHint}
        required={d.is_required}
        direction={direction}
        customLabelWidth={customLabelWidth}
        {...docLayoutProps}
        description={privacyDescription || undefined}
        error={err}
        shouldShowError={shouldShowError}
        Input={
          <CustomDatePicker
            name={d.field_key}
            value={valid ? selected : null}
            showTimeSelect={showTime}
            required={d.is_required}
            disabled={readOnly}
            placeholder={ph.trim() || undefined}
            error={err}
            shouldShowError={shouldShowError}
            documentFieldStyle={useDoc}
            onChange={(date) => {
              if (!date) {
                onPatch(d.field_key, "");
                return;
              }
              const serialized = showTime
                ? toLocalDatetimeLocalString(date)
                : toLocalDateString(date);
              onPatch(d.field_key, serialized);
            }}
          />
        }
      />
    );
  }

  if (
    d.data_type === "number" ||
    d.data_type === "decimal" ||
    d.data_type === "currency" ||
    d.data_type === "percentage"
  ) {
    const step = d.data_type === "number" ? "1" : "0.01";
    return (
      <InputFieldWithLabel
        label={labelWithHint}
        required={d.is_required}
        direction={direction}
        customLabelWidth={customLabelWidth}
        {...docLayoutProps}
        description={privacyDescription || undefined}
        error={err}
        shouldShowError={shouldShowError}
        Input={
          <InputField
            type="number"
            step={step}
            name={d.field_key}
            value={v === null || v === undefined ? "" : v}
            disabled={readOnly}
            readOnly={readOnly}
            placeholder={ph}
            onChange={(e) => {
              const raw = e.target.value;
              onPatch(
                d.field_key,
                raw === "" ? "" : Number(raw),
              );
            }}
            error={err}
            shouldShowError={shouldShowError}
            theme={fieldTheme}
          />
        }
      />
    );
  }

  if (d.data_type === "auto_number") {
    return (
      <InputFieldWithLabel
        label={labelWithHint}
        required={d.is_required}
        direction={direction}
        customLabelWidth={customLabelWidth}
        {...docLayoutProps}
        description={privacyDescription || undefined}
        Input={
          <InputField
            type="text"
            name={d.field_key}
            value={v ?? ""}
            readOnly
            disabled
            placeholder="Assigned on save"
            theme="gray"
          />
        }
      />
    );
  }

  if (d.data_type === "lookup") {
    return (
      <InputFieldWithLabel
        label={labelWithHint}
        required={d.is_required}
        direction={direction}
        customLabelWidth={customLabelWidth}
        {...docLayoutProps}
        description={privacyDescription || undefined}
        error={err}
        shouldShowError={shouldShowError}
        Input={
          <InputField
            type="text"
            name={d.field_key}
            value={v ?? ""}
            disabled={readOnly}
            readOnly={readOnly}
            placeholder={
              ph.trim() ||
              `Record id (${d.lookup_module || "module"} / ${d.lookup_screen || "screen"})`
            }
            onChange={(e) => onPatch(d.field_key, e.target.value)}
            error={err}
            shouldShowError={shouldShowError}
            theme={fieldTheme}
          />
        }
      />
    );
  }

  if (d.data_type === "external_lookup") {
    return (
      <div className="min-w-0 space-y-3">
        <InputFieldWithLabel
          label={labelWithHint}
          required={d.is_required}
          direction={direction}
          customLabelWidth={customLabelWidth}
          {...docLayoutProps}
          description={privacyDescription || undefined}
          error={err}
          shouldShowError={shouldShowError}
          Input={
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <InputField
                type="url"
                value={d.external_lookup_config?.url || ""}
                disabled
                readOnly
                placeholder="API URL (configured in settings)"
                theme="gray"
              />
              <InputField
                type="text"
                name={d.field_key}
                value={v ?? ""}
                disabled={readOnly}
                readOnly={readOnly}
                placeholder={ph.trim() || "External id / value"}
                onChange={(e) => onPatch(d.field_key, e.target.value)}
                error={err}
                shouldShowError={shouldShowError}
                theme={fieldTheme}
              />
            </div>
          }
        />
      </div>
    );
  }

  if (d.data_type === "file" || d.data_type === "image") {
    return (
      <InputFieldWithLabel
        label={labelWithHint}
        required={d.is_required}
        direction={direction}
        customLabelWidth={customLabelWidth}
        {...docLayoutProps}
        description={privacyDescription || undefined}
        error={err}
        shouldShowError={shouldShowError}
        Input={
          <div className="min-w-0 space-y-2">
            {!readOnly && uploadFile ? (
              <input
                type="file"
                accept={d.data_type === "image" ? "image/*" : undefined}
                className="text-sm min-w-0 w-full max-w-full"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f || !uploadFile) return;
                  try {
                    const url = await uploadFile(f);
                    onPatch(d.field_key, url);
                  } catch (err) {
                    console.error(err);
                  }
                }}
              />
            ) : null}
            {v ? (
              <p className="text-xs text-gray-600 break-all">{String(v)}</p>
            ) : null}
          </div>
        }
      />
    );
  }

  const inputType =
    d.data_type === "email"
      ? "email"
      : d.data_type === "url"
        ? "url"
        : d.data_type === "phone"
          ? "tel"
          : "text";

  return (
    <InputFieldWithLabel
      label={labelWithHint}
      required={d.is_required}
      direction={direction}
      customLabelWidth={customLabelWidth}
      {...docLayoutProps}
      description={privacyDescription || undefined}
      error={err}
      shouldShowError={shouldShowError}
      Input={
        <InputField
          type={inputType}
          name={d.field_key}
          value={v ?? ""}
          disabled={readOnly}
          readOnly={readOnly}
          placeholder={ph}
          onChange={(e) => onPatch(d.field_key, e.target.value)}
          error={err}
          shouldShowError={shouldShowError}
          theme={fieldTheme}
        />
      }
    />
  );
}
