import React from "react";

import { StepHeading, StepNote } from "../../../components/wizard/ApplicationWizard";
import AddressAutocomplete from "../../../components/ui/AddressAutocomplete";
import Combobox from "../../../components/ui/Combobox";
import {
  FormGrid,
  TextField,
  TextareaField,
} from "../../../components/ui/Field";
import { parseGoogleAddressComponents } from "@/utils/parseGoogleAddress";

/**
 * Renders a wizard step from a field spec.
 *
 * Most steps in both wizards are a heading plus a two-column grid of fields, so
 * they are declared as data in `stepFields.js` rather than written out as
 * markup seven times. A step needing something bespoke (tables, checklists)
 * gets its own component instead.
 *
 * A field is `{ name, label, type?, options?, placeholder?, full?, readOnly?,
 * rows?, hint?, gpsField?, streetField?, blockField?, cityStateField? }`.
 *
 * Address fields require a Google Places pick (GPS is captured in the background
 * and not shown). Manual typing clears GPS / structured address fields so
 * Continue stays blocked until a suggestion is selected.
 */
export default function FieldStep({
  title,
  subtitle,
  fields = [],
  values = {},
  errors = {},
  onChange,
  note,
  children,
}) {
  const set = (name) => (next) => {
    onChange?.(name, next?.target ? next.target.value : next);
  };

  const setPatch = (patch) => {
    if (typeof onChange === "function") {
      onChange(patch);
    }
  };

  const clearPlaceDerived = (field) => {
    const patch = {};
    if (field.gpsField) patch[field.gpsField] = "";
    if (field.streetField) patch[field.streetField] = "";
    if (field.blockField) patch[field.blockField] = "";
    if (field.cityStateField) patch[field.cityStateField] = "";
    return patch;
  };

  return (
    <>
      <StepHeading title={title} subtitle={subtitle} />

      {children}

      <FormGrid>
        {fields.map((field) => {
          const shared = {
            key: field.name,
            name: field.name,
            label: field.label,
            full: field.full,
            hint: field.hint,
            value: values[field.name] ?? "",
            error: errors[field.name],
            onChange: set(field.name),
          };

          if (field.type === "select") {
            return (
              <Combobox
                {...shared}
                placeholder={field.placeholder || "Select"}
                options={field.options || []}
              />
            );
          }

          if (field.type === "textarea") {
            return (
              <TextareaField
                {...shared}
                rows={field.rows || 4}
                readOnly={field.readOnly}
                placeholder={field.placeholder}
              />
            );
          }

          if (field.type === "address") {
            return (
              <AddressAutocomplete
                key={field.name}
                label={field.label}
                name={field.name}
                full={field.full}
                hint={field.hint}
                placeholder={
                  field.placeholder || "Start typing and select from Google"
                }
                requirePlaceSelection
                value={values[field.name] ?? ""}
                error={errors[field.name]}
                readOnly={field.readOnly}
                onChange={(next) => {
                  setPatch({
                    [field.name]: next,
                    ...clearPlaceDerived(field),
                  });
                }}
                onPlaceSelected={({
                  formattedAddress,
                  gpsCoordinates,
                  components,
                }) => {
                  const parsed = parseGoogleAddressComponents(components);
                  const patch = {
                    [field.name]: formattedAddress || values[field.name] || "",
                  };
                  if (field.gpsField) {
                    patch[field.gpsField] = gpsCoordinates || "";
                  }
                  if (field.streetField) {
                    patch[field.streetField] =
                      parsed.street || formattedAddress || "";
                  }
                  if (field.blockField) {
                    patch[field.blockField] = parsed.block || "";
                  }
                  if (field.cityStateField && parsed.cityState) {
                    patch[field.cityStateField] = parsed.cityState;
                  }
                  setPatch(patch);
                }}
              />
            );
          }

          // GPS is captured from Google Places but not shown in application forms.
          if (field.type === "gps") {
            return null;
          }

          return (
            <TextField
              {...shared}
              type={field.type || "text"}
              readOnly={field.readOnly}
              placeholder={field.placeholder}
            />
          );
        })}
      </FormGrid>

      {note && <StepNote title={note.title}>{note.body}</StepNote>}
    </>
  );
}
